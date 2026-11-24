import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { fetchUrlMetadata, SsrfOrValidationError } from './server/metadataFetch';
import { DEFAULT_PREVIEW_EMAIL, StoreError, VaultStore } from './server/store';
import { itemsToCsv } from './src/lib/searchAndExport';
import type { ItemStatus, ItemType, UserProfile } from './src/lib/types';

const PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE = 'vault_session';
const LOGGED_OUT_COOKIE = 'vault_logged_out';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const store = new VaultStore();

interface AuthedRequest extends Request {
  user?: UserProfile;
}

function signToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { uid?: string };
    return typeof parsed.uid === 'string' ? parsed.uid : null;
  } catch {
    return null;
  }
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = decodeURIComponent(part.slice(eq + 1).trim());
    result[key] = val;
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function setSessionCookie(req: Request, res: Response, userId: string): void {
  const token = signToken(userId);
  const https = isHttpsRequest(req);
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Max-Age=2592000',
    https ? 'Secure; SameSite=None; Partitioned' : 'SameSite=Lax',
  ];
  const clearLoggedOut = [
    `${LOGGED_OUT_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    https ? 'Secure; SameSite=None; Partitioned' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', [attrs.join('; '), clearLoggedOut.join('; ')]);
}

function clearSessionCookie(req: Request, res: Response): void {
  const https = isHttpsRequest(req);
  const clearSession = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    https ? 'Secure; SameSite=None; Partitioned' : 'SameSite=Lax',
  ];
  const setLoggedOut = [
    `${LOGGED_OUT_COOKIE}=1`,
    'Path=/',
    'HttpOnly',
    'Max-Age=2592000',
    https ? 'Secure; SameSite=None; Partitioned' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', [clearSession.join('; '), setLoggedOut.join('; ')]);
}

function resolveUserFromRequest(req: Request): { user: UserProfile | null; explicitLogout: boolean } {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const uid = verifyToken(authHeader.slice(7).trim());
    if (uid) {
      const user = store.getUserById(uid);
      if (user) return { user, explicitLogout: false };
    }
  }
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) {
    const uid = verifyToken(token);
    if (uid) {
      const user = store.getUserById(uid);
      if (user) return { user, explicitLogout: false };
    }
  }
  return { user: null, explicitLogout: cookies[LOGGED_OUT_COOKIE] === '1' };
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const { user } = resolveUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  // CSRF check for cookie-authenticated state-changing requests
  const method = req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !req.headers.authorization) {
    const requestedWith = req.headers['x-requested-with'];
    if (requestedWith !== 'Vault') {
      res.status(403).json({ error: 'Missing required request header' });
      return;
    }
  }
  req.user = user;
  next();
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '512kb' }));

  // Auth routes
  app.get('/api/auth/session', (req, res) => {
    const { user, explicitLogout } = resolveUserFromRequest(req);
    if (user) {
      res.json({ user, signedOut: false });
      return;
    }
    if (!explicitLogout) {
      // Seamless local workspace sign-in on first load when Supabase isn't configured
      const previewUser = store.findOrCreateUser(DEFAULT_PREVIEW_EMAIL, 'Vault User');
      setSessionCookie(req, res, previewUser.id);
      res.json({ user: previewUser, signedOut: false });
      return;
    }
    res.json({ user: null, signedOut: true });
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email : DEFAULT_PREVIEW_EMAIL;
      const name = typeof req.body?.name === 'string' ? req.body.name : undefined;
      const user = store.findOrCreateUser(email, name);
      setSessionCookie(req, res, user.id);
      res.json({ user });
    } catch (err) {
      if (err instanceof StoreError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Failed to sign in' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // Metadata endpoint (SSRF-protected)
  app.post('/api/metadata', requireAuth, async (req: AuthedRequest, res) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
    if (!rawUrl.trim()) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }
    try {
      const metadata = await fetchUrlMetadata(rawUrl);
      const duplicate = store.findItemByUrl(req.user!.id, metadata.url);
      res.json({
        ...metadata,
        duplicateItem: duplicate,
      });
    } catch (err) {
      if (err instanceof SsrfOrValidationError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Failed to inspect URL' });
    }
  });

  // Categories
  app.get('/api/categories', requireAuth, (req: AuthedRequest, res) => {
    res.json({ categories: store.listCategories(req.user!.id) });
  });

  app.post('/api/categories', requireAuth, (req: AuthedRequest, res) => {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name : '';
      const category = store.createCategory(req.user!.id, name);
      res.status(201).json({ category });
    } catch (err) {
      if (err instanceof StoreError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Failed to create category' });
    }
  });

  app.patch('/api/categories/reorder', requireAuth, (req: AuthedRequest, res) => {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((x: unknown): x is string => typeof x === 'string')
      : [];
    const categories = store.reorderCategories(req.user!.id, ids);
    res.json({ categories });
  });

  app.patch('/api/categories/:id', requireAuth, (req: AuthedRequest, res) => {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name : '';
      const category = store.renameCategory(req.user!.id, req.params.id, name);
      res.json({ category });
    } catch (err) {
      if (err instanceof StoreError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Failed to update category' });
    }
  });

  app.delete('/api/categories/:id', requireAuth, (req: AuthedRequest, res) => {
    try {
      store.deleteCategory(req.user!.id, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof StoreError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Failed to delete category' });
    }
  });

  // Items
  app.get('/api/items', requireAuth, (req: AuthedRequest, res) => {
    const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
    const inbox = req.query.inbox === '1' || req.query.inbox === 'true';
    const type = typeof req.query.type === 'string' ? (req.query.type as ItemType) : undefined;
    const status =
      typeof req.query.status === 'string' ? (req.query.status as ItemStatus) : undefined;
    const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const limit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;
    const offset =
      typeof req.query.offset === 'string' ? Number.parseInt(req.query.offset, 10) : undefined;

    const result = store.listItems(req.user!.id, {
      categoryId,
      inbox,
      type,
      status,
      tag,
      q,
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });
    res.json(result);
  });

  app.post('/api/items', requireAuth, (req: AuthedRequest, res) => {
    try {
      const item = store.createItem(req.user!.id, req.body);
      res.status(201).json({ item });
    } catch (err) {
      if (err instanceof StoreError) {
        res.status(err.status).json({
          error: err.message,
          code: err.code,
          existingItem: err.existingItem,
        });
        return;
      }
      res.status(500).json({ error: 'Failed to save item' });
    }
  });

  app.patch('/api/items/:id', requireAuth, (req: AuthedRequest, res) => {
    try {
      const item = store.updateItem(req.user!.id, req.params.id, req.body);
      res.json({ item });
    } catch (err) {
      if (err instanceof StoreError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Failed to update item' });
    }
  });

  app.delete('/api/items/:id', requireAuth, (req: AuthedRequest, res) => {
    try {
      store.deleteItem(req.user!.id, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof StoreError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Failed to delete item' });
    }
  });

  // Tags
  app.get('/api/tags', requireAuth, (req: AuthedRequest, res) => {
    res.json({ tags: store.listTags(req.user!.id) });
  });

  // Export
  app.get('/api/export', requireAuth, (req: AuthedRequest, res) => {
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const categories = store.listCategories(req.user!.id);
    const { items } = store.listItems(req.user!.id, { limit: 100000 });

    if (format === 'csv') {
      const csv = itemsToCsv(items, categories);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="vault-export.csv"');
      res.send(csv);
      return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="vault-export.json"');
    res.send(
      JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          categories,
          items,
        },
        null,
        2,
      ),
    );
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vault server listening on http://localhost:${PORT}`);
  });
}

startServer();
