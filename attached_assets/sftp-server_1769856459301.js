import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Client from 'ssh2-sftp-client';
import * as ftp from 'basic-ftp';
const { Client: FTPClient } = ftp;
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import stream from 'stream';
import archiver from 'archiver';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { validateConnectRequest, sanitizePath } from './middleware/validation.js';
import { errorHandler, AppError } from './middleware/errorHandler.js';
import {
    initDb,
    isDbEnabled,
    logAppLog,
    logConnectionEvent,
    logDownloadEvent,
    upsertTransferTasks,
    listConnectionEvents,
    listDownloadEvents,
    listAppLogs,
    listTransferTasks,
    insertAnalyticsSnapshot,
    listAnalyticsSnapshots,
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const LOG_LEVEL = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'info')).toLowerCase();
const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const logLevelValue = LOG_LEVELS[LOG_LEVEL] ?? LOG_LEVELS.info;
const log = {
    debug: (...args) => { if (logLevelValue <= LOG_LEVELS.debug) console.log('[DEBUG]', ...args); },
    info: (...args) => { if (logLevelValue <= LOG_LEVELS.info) console.log('[INFO]', ...args); },
    warn: (...args) => { if (logLevelValue <= LOG_LEVELS.warn) console.warn('[WARN]', ...args); },
    error: (...args) => { if (logLevelValue <= LOG_LEVELS.error) console.error('[ERROR]', ...args); },
};

const app = express();

// 1. Trust proxy in production
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

// 2. Security Headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  } : false,
  crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
  crossOriginOpenerPolicy: process.env.NODE_ENV === 'production',
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: process.env.NODE_ENV === 'production' ? { 
    maxAge: 31536000, 
    includeSubDomains: true,
    preload: true
  } : false,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));

// 3. Request Size Limits
app.use(express.json({ 
  limit: process.env.MAX_JSON_BODY || '1mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      throw new AppError('Invalid JSON', 400);
    }
  }
}));

app.use(express.urlencoded({ 
  limit: process.env.MAX_URLENCODED_BODY || '1mb',
  parameterLimit: 100, // Limit number of parameters
  extended: false // Use basic query string parser
}));

// 2. Security Headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
  crossOriginOpenerPolicy: process.env.NODE_ENV === 'production',
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin for downloads
  dnsPrefetchControl: false,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: process.env.NODE_ENV === 'production' ? { 
    maxAge: 31536000, 
    includeSubDomains: true 
  } : false,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));

// 3. CORS Configuration
app.use(cors({
  origin: (origin, cb) => {
    // allow non-browser clients (no origin)
    if (!origin) return cb(null, true);
    // in development, allow all origins to avoid breaking local dev setups
    if (process.env.NODE_ENV !== 'production') return cb(null, true);
    if ((process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  credentials: false
}));

app.use(express.json({ 
  limit: process.env.MAX_JSON_BODY || '1mb' 
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_URLENCODED_BODY || '1mb' 
}));

app.use(express.static(__dirname));

// Rate limiting (safe defaults)
const SFTP_RATE_LIMIT_MAX = parseInt(process.env.SFTP_RATE_LIMIT_MAX || '5000', 10);
const sftpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number.isFinite(SFTP_RATE_LIMIT_MAX) ? SFTP_RATE_LIMIT_MAX : 5000,
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/sftp', sftpLimiter);

const dbLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/db', dbLimiter);

// Prevents favicon 404 errors
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Configure multer
const upload = multer({ dest: 'uploads/' });

// Store active sessions
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS || '200', 10);
const MAX_SESSIONS_PER_IP = parseInt(process.env.MAX_SESSIONS_PER_IP || '10', 10);
const SESSION_IDLE_MS = parseInt(process.env.SESSION_IDLE_MS || (30 * 60 * 1000), 10); // 30 min default
const SESSION_OP_TIMEOUT_MS = parseInt(process.env.SESSION_OP_TIMEOUT_MS || (15 * 60 * 1000), 10); // 15 min default
const LIST_RECURSIVE_TIMEOUT_MS = parseInt(process.env.LIST_RECURSIVE_TIMEOUT_MS || (15 * 60 * 1000), 10); // 15 min default
const DOWNLOAD_OP_TIMEOUT_MS = parseInt(process.env.DOWNLOAD_OP_TIMEOUT_MS || (30 * 60 * 1000), 10); // 30 min default

// Upstream keepalive: some FTP/SFTP servers drop idle control connections quickly.
// Keepalive runs server-side (not browser-dependent) so background tabs don't cause disconnects.
const SESSION_KEEPALIVE_MS = parseInt(process.env.SESSION_KEEPALIVE_MS || (60 * 1000), 10); // 60s
const SESSION_KEEPALIVE_IDLE_THRESHOLD_MS = parseInt(process.env.SESSION_KEEPALIVE_IDLE_THRESHOLD_MS || (45 * 1000), 10); // 45s

const sessions = new Map();
const sessionOps = new Map();
const sessionsByIp = new Map();
const sessionTimeout = 120000; // 2 minutes

// Helper: Promise timeout
const withTimeout = (promise, ms, errMsg) => {
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error(errMsg || `Operation timed out after ${ms}ms`)), ms));
    return Promise.race([promise, timeout]);
}

async function testFtpConnection({ host, port = 21, user, password, timeout = 8000 }) {
    const started = Date.now();
    const client = new FTPClient();
    client.ftp.verbose = false;
    try {
        await withTimeout(
            client.access({
                host,
                port,
                user,
                password,
                secure: false,
            }),
            timeout,
            'FTP connection timed out'
        );
        return { ok: true, client, took: Date.now() - started };
    } catch (err) {
        try { client.close(); } catch (e) {}
        const msg = err && err.message ? String(err.message) : String(err);
        return { ok: false, error: msg, took: Date.now() - started };
    }
}

async function testSftpConnection({ host, port = 22, user, password, timeout = 8000 }) {
    const started = Date.now();
    const sftp = new Client();
    try {
        await withTimeout(
            sftp.connect({
                host,
                port,
                username: user,
                password,
                readyTimeout: timeout,
            }),
            timeout,
            'SFTP connection timed out'
        );
        return { ok: true, sftp, took: Date.now() - started };
    } catch (err) {
        try { await sftp.end(); } catch (e) {}
        const msg = err && err.message ? String(err.message) : String(err);
        return { ok: false, error: msg, took: Date.now() - started };
    }
}

function isSessionExpiredError(err) {
    const msg = err && err.message ? String(err.message) : String(err);
    const code = err && err.code ? String(err.code) : '';
    // Operation timeouts are not necessarily an upstream disconnect; don't treat them as session-expired.
    if (/timed out/i.test(msg)) return false;
    return (
        /session expired/i.test(msg) ||
        /client is closed/i.test(msg) ||
        /server sent fin packet/i.test(msg) ||
        /econnreset/i.test(msg) ||
        /socket hang up/i.test(msg) ||
        code === 'ECONNRESET'
    );
}

function cleanupSession(sessionId, reason = 'unknown') {
  const session = sessions.get(sessionId);
  if (!session) return;

  try {
    if (session._keepaliveTimer) {
      clearInterval(session._keepaliveTimer);
      session._keepaliveTimer = null;
    }
  } catch (e) {}
  
  // Remove from IP tracking
  if (session.ip) {
    const ipSessions = sessionsByIp.get(session.ip);
    if (ipSessions) {
      ipSessions.delete(sessionId);
      if (ipSessions.size === 0) {
        sessionsByIp.delete(session.ip);
      }
    }
  }
  
  try {
    if (session.type === 'sftp') {
      try { session.client.end(); } catch (e) {}
    } else {
      try { session.client.close(); } catch (e) {}
    }
  } catch (e) {}
  sessions.delete(sessionId);
  log.info(`[SESSION] ${sessionId} cleaned up (${reason})`);
}

// Session cleanup
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
        if (now - session.lastActivity > SESSION_IDLE_MS) {
            try {
                if (session._keepaliveTimer) {
                    clearInterval(session._keepaliveTimer);
                    session._keepaliveTimer = null;
                }
            } catch (e) {}
            if (session.type === 'sftp') session.client.end();
            else session.client.close();
            sessions.delete(sessionId);
            log.info(`[SESSION] ${sessionId} expired`);
        }
    }
}, 5 * 60 * 1000);

function startSessionKeepalive(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return;
    if (!Number.isFinite(SESSION_KEEPALIVE_MS) || SESSION_KEEPALIVE_MS <= 0) return;
    if (session._keepaliveTimer) return;

    session._keepaliveTimer = setInterval(async () => {
        try {
            const s = sessions.get(sessionId);
            if (!s) return;

            const now = Date.now();
            // Don't spam keepalives if session has recent activity.
            if (now - (s.lastActivity || 0) < SESSION_KEEPALIVE_IDLE_THRESHOLD_MS) return;

            // Run via session op queue to avoid concurrent client operations.
            await runSessionOp(
                sessionId,
                async (sess) => {
                    // Mark as activity so idle upstream doesn't disconnect.
                    sess.lastActivity = Date.now();
                    if (sess.type === 'ftp') {
                        // basic-ftp supports NOOP
                        if (sess.client && typeof sess.client.send === 'function') {
                            return sess.client.send('NOOP');
                        }
                        // fallback: list current dir (last resort)
                        return sess.client.list('.');
                    }
                    // ssh2-sftp-client has realPath which is lightweight.
                    if (sess.client && typeof sess.client.realPath === 'function') {
                        return sess.client.realPath('.');
                    }
                    return sess.client.list('.');
                },
                10_000
            );
        } catch (err) {
            // Let runSessionOp decide if this is an upstream disconnect; it will cleanup if needed.
        }
    }, SESSION_KEEPALIVE_MS);
}

// Session creation utility: attach event handlers and defaults
function createSession(sessionId, { type, client, server, username, isAdmin = false, timeout = SESSION_OP_TIMEOUT_MS, ip } = {}) { 
    // Do NOT store credentials (password/port) on the session.
    // Check session limits
  if (sessions.size >= MAX_SESSIONS) {
    throw new Error('Maximum number of sessions reached. Please try again later.');
  }

  if (ip) {
    const ipSessions = sessionsByIp.get(ip) || new Set();
    if (ipSessions.size >= MAX_SESSIONS_PER_IP) {
      throw new Error('Maximum number of sessions per IP reached.');
    }
    ipSessions.add(sessionId);
    sessionsByIp.set(ip, ipSessions);
  }

  const session = { 
    id: sessionId, 
    type, 
    client, 
    server, 
    username, 
    isAdmin, 
    lastActivity: Date.now(), 
    timeout,
    ip,
    _keepaliveTimer: null,
  };
  
  sessions.set(sessionId, session);
  sessionOps.set(sessionId, Promise.resolve());
  // Start background keepalive so switching tabs/windows doesn't drop upstream sessions.
  try { startSessionKeepalive(sessionId); } catch (e) {}
  return session;
}

// Per-session op queue helper to avoid concurrent FTP client operations
function runSessionOp(sessionId, fn, opTimeout) {
	const session = sessions.get(sessionId);
	if (!session) throw new Error('Session expired');
	// initialize queue promise
	if (!session._queue) session._queue = Promise.resolve();
	const timeoutMs = typeof opTimeout === 'number' ? opTimeout : (session.timeout || SESSION_OP_TIMEOUT_MS);

	// Capture the previous queue so we can return the real operation promise to the caller,
	// but keep session._queue in a resolved state even if the operation fails (prevents queue from getting stuck rejected).
	const prev = session._queue;
	const opPromise = prev.then(async () => {
		session.lastActivity = Date.now();
		return withTimeout(fn(session), timeoutMs, `Session operation timed out after ${timeoutMs}ms`);
	});

	// Ensure the queue continues even if opPromise rejects: log the error but do NOT leave session._queue rejected.
	session._queue = opPromise.catch(err => {
		// If the upstream connection is gone, clean up the session so callers get a clear "Session expired" on next request.
		if (isSessionExpiredError(err)) {
			cleanupSession(sessionId, 'upstream_disconnected');
			return;
		}
		// Some errors are expected/noisy (e.g., Readme.txt probe) and should not pollute Audit.
		const msg = err && err.message ? String(err.message) : '';
		const code = err && err.code ? String(err.code) : '';
		const isMissing = code === 'ENOENT' || /no such file/i.test(msg) || /xstat:/i.test(msg);
		const isReadme = /(^|\/|\\)readme\.txt$/i.test(msg.replace(/\\/g, '/'));
		if ((err && err._suppressAudit === true) || (isMissing && isReadme)) {
			return;
		}
		log.error('[SESSION-OP] error', err && err.message ? err.message : err);
		void logAppLog({
			level: 'error',
			message: err && err.message ? err.message : 'session op error',
			sessionId,
			context: {
				op: 'session_op',
				type: session.type,
				server: session.server,
				username: session.username,
			},
		});
		// swallow here to keep queue healthy; callers still receive the original opPromise result/rejection.
	});

	return opPromise;
}

// helper to attach handlers when replacing a session's client (used for reconnect)
function attachClientHandlersToSession(sessionId, client) {
	const session = sessions.get(sessionId);
	if (!session) return;
	try {
		if (client && typeof client.on === 'function') {
			client.on('error', (err) => {
				const msg = err && err.message ? err.message : err;
				log.error(`[SESSION][${sessionId}] client error`, msg);
				// Only destroy the session for errors that indicate the upstream connection is gone.
				// Transient FTP errors/timeouts can happen during large batch downloads; let the request-level logic retry.
				if (isSessionExpiredError(err)) {
					cleanupSession(sessionId, 'client_error');
				}
			});
			client.on('close', () => {
				log.info(`[SESSION][${sessionId}] client closed`);
				cleanupSession(sessionId, 'client_closed');
			});
			client.on('end', () => {
				log.info(`[SESSION][${sessionId}] client ended`);
				cleanupSession(sessionId, 'client_ended');
			});
		}
		// update session client ref
		session.client = client;
	} catch (e) {
		log.warn(`[SESSION][${sessionId}] attach handlers failed`, e && e.message ? e.message : e);
	}
}

// Remove reconnect-on-timeout behavior: retry transient FTP errors without storing credentials
async function ftpOpWithRetries(sessionId, opFn, { retries = 3, baseDelay = 2000 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            // run via the session queue to maintain serialization
            return await runSessionOp(sessionId, opFn);
        } catch (err) {
            lastErr = err;
            const msg = (err && err.message) ? err.message : '';
            const isTransient = msg.includes('Timeout (data socket)') || msg.includes('ETIMEDOUT') || /timed out/i.test(msg) || /timeout/i.test(msg);

            log.warn(`[FTP-RETRY] session=${sessionId} attempt=${attempt} transient=${isTransient} msg=${msg}`);

            // If the session/client has been closed, don't attempt silent reconnect here — surface error
            const session = sessions.get(sessionId);
            if (!session || !session.client) {
                log.warn(`[FTP-RETRY] session ${sessionId} has no client; aborting retries`);
                break;
            }

            // If transient, backoff and retry on the same client
            if (isTransient && attempt < retries) {
                await new Promise(r => setTimeout(r, baseDelay * (attempt + 1)));
                continue;
            }

            // otherwise break and throw
            break;
        }
    }
    throw lastErr;
}

/**
 * Universal Connect Handler
 */
// Input validation middleware for connect endpoint
app.post('/api/sftp/connect', 
  validateConnectRequest,
  sanitizePath,
  async (req, res) => {
    const { server, port, username, password, path: remotePath, protocol, isAdmin } = req.body;
 
    if (!server || !username) return res.status(400).json({ error: 'Server and username are required' });

    const sessionId = uuidv4();

    try {
        if (password && password.length > 255) throw new AppError('Password too long', 400);

        log.info(`Connection attempt for ${username}@${server}`);
        log.info(`[CONNECT] attempt ${username}@${server}:${port || '(default)'} protocol=${protocol || 'auto'}`);

        if (protocol === 'ftp') {
            const result = await testFtpConnection({ host: server, port: Number(port) || 21, user: username, password, timeout: 8000 });
            if (!result.ok) {
                void logConnectionEvent({ sessionId, requestedProtocol: protocol || 'auto', protocol: 'ftp', username, server, port: Number(port) || 21, success: false, errorMessage: result.error, userAgent: req.headers['user-agent'], ip: req.ip });
                return res.status(502).json({ error: `FTP connection failed: ${result.error}` });
            }

            createSession(sessionId, { type: 'ftp', client: result.client, server, username, password, port: Number(port) || 21, isAdmin: Boolean(isAdmin) });
            void logConnectionEvent({ sessionId, requestedProtocol: protocol || 'auto', protocol: 'ftp', username, server, port: Number(port) || 21, success: true, errorMessage: null, userAgent: req.headers['user-agent'], ip: req.ip });

            const files = await result.client.list(remotePath || '/');
            return res.json({ success: true, sessionId, type: 'ftp', files: files.map(f => ({ name: f.name, size: f.size, isDirectory: f.type === 2, path: (remotePath || '/').endsWith('/') ? (remotePath || '/') + f.name : (remotePath || '/') + '/' + f.name })) });
        }

        if (protocol === 'sftp') {
            const result = await testSftpConnection({ host: server, port: Number(port) || 22, user: username, password, timeout: 8000 });
            if (!result.ok) {
                void logConnectionEvent({ sessionId, requestedProtocol: protocol || 'auto', protocol: 'sftp', username, server, port: Number(port) || 22, success: false, errorMessage: result.error, userAgent: req.headers['user-agent'], ip: req.ip });
                return res.status(502).json({ error: `SFTP connection failed: ${result.error}` });
            }

            createSession(sessionId, { type: 'sftp', client: result.sftp, server, username, isAdmin: Boolean(isAdmin) });
            void logConnectionEvent({ sessionId, requestedProtocol: protocol || 'auto', protocol: 'sftp', username, server, port: Number(port) || 22, success: true, errorMessage: null, userAgent: req.headers['user-agent'], ip: req.ip });

            const files = await result.sftp.list(remotePath || '/');
            return res.json({ success: true, sessionId, type: 'sftp', files: files.map(f => ({ name: f.name, size: f.size, isDirectory: f.type === 'd', path: (remotePath || '/').endsWith('/') ? (remotePath || '/') + f.name : (remotePath || '/') + '/' + f.name })) });
        }

        const sres = await testSftpConnection({ host: server, port: Number(port) || 22, user: username, password, timeout: 8000 });
        if (sres.ok) {
            createSession(sessionId, { type: 'sftp', client: sres.sftp, server, username, isAdmin: Boolean(isAdmin) });
            void logConnectionEvent({ sessionId, requestedProtocol: protocol || 'auto', protocol: 'sftp', username, server, port: Number(port) || 22, success: true, errorMessage: null, userAgent: req.headers['user-agent'], ip: req.ip });
            const files = await sres.sftp.list(remotePath || '/');
            return res.json({ success: true, sessionId, type: 'sftp', files: files.map(f => ({ name: f.name, size: f.size, isDirectory: f.type === 'd', path: (remotePath || '/').endsWith('/') ? (remotePath || '/') + f.name : (remotePath || '/') + '/' + f.name })) });
        }

        if (sres.error && (sres.error.includes('Expected SSH banner') || sres.error.includes('Unsupported protocol') || Number(port) !== 22)) {
            const fres = await testFtpConnection({ host: server, port: Number(port) || 21, user: username, password, timeout: 8000 });
            if (!fres.ok) {
                void logConnectionEvent({ sessionId, requestedProtocol: protocol || 'auto', protocol: 'ftp', username, server, port: Number(port) || 21, success: false, errorMessage: fres.error, userAgent: req.headers['user-agent'], ip: req.ip });
                return res.status(502).json({ error: `FTP connection failed: ${fres.error}` });
            }

            createSession(sessionId, { type: 'ftp', client: fres.client, server, username, password, port: Number(port) || 21, isAdmin: Boolean(isAdmin) });
            void logConnectionEvent({ sessionId, requestedProtocol: protocol || 'auto', protocol: 'ftp', username, server, port: Number(port) || 21, success: true, errorMessage: null, userAgent: req.headers['user-agent'], ip: req.ip });
            const files = await fres.client.list(remotePath || '/');
            return res.json({ success: true, sessionId, type: 'ftp', files: files.map(f => ({ name: f.name, size: f.size, isDirectory: f.type === 2, path: (remotePath || '/').endsWith('/') ? (remotePath || '/') + f.name : (remotePath || '/') + '/' + f.name })) });
        }

        void logConnectionEvent({ sessionId, requestedProtocol: protocol || 'auto', protocol: 'sftp', username, server, port: Number(port) || 22, success: false, errorMessage: sres.error, userAgent: req.headers['user-agent'], ip: req.ip });
        return res.status(502).json({ error: `SFTP connection failed: ${sres.error}` });
    } catch (err) {
        log.error('[CONNECT] unexpected error', err && err.message ? err.message : err);
        try {
            await logConnectionEvent({ sessionId, requestedProtocol: protocol || 'auto', protocol: null, username, server, port: port || null, success: false, errorMessage: err && err.message ? err.message : String(err), userAgent: req.headers['user-agent'], ip: req.ip });
        } catch (e) {
        }
        return res.status(500).json({ error: 'Connection failed', details: process.env.NODE_ENV === 'development' ? (err && err.message ? err.message : String(err)) : undefined });
    }
  }
);

/**
 * Universal List Handler
 */
app.get('/api/sftp/list-recursive', async (req, res) => {
    const { sessionId, path: remotePath } = req.query;
    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session expired' });

    try {
        const fileList = [];
        const listFiles = async (currentPath) => {
            const items = await runSessionOp(sessionId, s => s.client.list(currentPath), LIST_RECURSIVE_TIMEOUT_MS);

            for (const item of items) {
                const itemPath = path.posix.join(currentPath, item.name);
                const isDirectory = session.type === 'sftp'
                    ? (item && item.type === 'd')
                    : (item && item.type === 2);

                if (isDirectory) {
                    await listFiles(itemPath);
                } else {
                    fileList.push({
                        name: item.name,
                        size: item.size,
                        isDirectory: false,
                        path: itemPath,
                    });
                }
            }
        };

        await listFiles(remotePath || '/');
        res.json({ success: true, files: fileList });
    } catch (error) {
        if (isSessionExpiredError(error)) {
            cleanupSession(sessionId, 'list_failed');
            return res.status(440).json({ error: 'Session expired' });
        }
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sftp/list', async (req, res) => {
    const { sessionId, path: remotePath } = req.query;
    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session expired' });

    try {
        const files = await runSessionOp(sessionId, async (s) => {
            if (s.type === 'sftp') {
                const list = await s.client.list(remotePath || '/');
                return list.map(f => ({
                    name: f.name, size: f.size, isDirectory: f.type === 'd',
                    path: (remotePath || '/').endsWith('/') ? (remotePath || '/') + f.name : (remotePath || '/') + '/' + f.name
                }));
            } else {
                const list = await s.client.list(remotePath || '/');
                return list.map(f => ({
                    name: f.name, size: f.size, isDirectory: f.type === 2,
                    path: (remotePath || '/').endsWith('/') ? (remotePath || '/') + f.name : (remotePath || '/') + '/' + f.name
                }));
            }
		}, SESSION_OP_TIMEOUT_MS);
        res.json({ success: true, files });
    } catch (error) {
        if (isSessionExpiredError(error)) {
            cleanupSession(sessionId, 'list_failed');
            return res.status(440).json({ error: 'Session expired' });
        }
        res.status(500).json({ error: error.message });
    }
});

/**
 * Universal Download Handler (with Range support)
 */
app.get('/api/sftp/download', async (req, res) => {
    const { sessionId, file: remotePath } = req.query;
    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session expired' });

    try {
        log.debug(`[DOWNLOAD] ${sessionId} ${session.type} ${remotePath}`);

        // Best-effort event logging (async, does not block download)
        logDownloadEvent({
            sessionId,
            protocol: session.type,
            username: session.username,
            server: session.server,
            remotePath,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
        });

        const fileName = path.basename(remotePath);
        const isReadme = typeof remotePath === 'string' && /(^|\/)readme\.txt$/i.test(remotePath.replace(/\\/g, '/'));
        let sftpReadStream = null;

        // If client disconnects mid-transfer, ensure upstream read stream is closed.
        res.on('close', () => {
            try {
                if (sftpReadStream && typeof sftpReadStream.destroy === 'function') {
                    sftpReadStream.destroy();
                }
            } catch (e) {
                // ignore
            }
        });

        // Perform size/stat under session queue to avoid concurrent client ops
        const fileSize = await runSessionOp(sessionId, async (s) => {
            try {
                if (s.type === 'sftp') {
                    const stats = await s.client.stat(remotePath);
                    return stats.size;
                } else {
                    return await s.client.size(remotePath);
                }
            } catch (e) {
                // Missing Readme.txt is common during project discovery; don't log it into Audit.
                if (isReadme) {
                    try { e._suppressAudit = true; } catch (_) {}
                }
                throw e;
            }
        }, DOWNLOAD_OP_TIMEOUT_MS);

        const range = req.headers.range;
        if (range) {
            log.debug(`[DOWNLOAD] range ${sessionId} ${range}`);
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;

            res.status(206).set({
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            });

            if (session.type === 'sftp') {
                // SFTP stream read doesn't need serialization here, but keep activity updated
                session.lastActivity = Date.now();
                sftpReadStream = session.client.sftp.createReadStream(remotePath, { start, end });
                sftpReadStream.pipe(res);
            } else {
                // FTP download must be serialized to avoid basic-ftp concurrent task error
                await runSessionOp(sessionId, async (s) => {
                    return s.client.downloadTo(res, remotePath, start);
				}, DOWNLOAD_OP_TIMEOUT_MS);
            }
        } else {
            res.set({
                'Content-Length': fileSize,
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Accept-Ranges': 'bytes',
            });
            if (session.type === 'sftp') {
                session.lastActivity = Date.now();
                sftpReadStream = session.client.sftp.createReadStream(remotePath);
                sftpReadStream.pipe(res);
            } else {
                await runSessionOp(sessionId, async (s) => {
                    return s.client.downloadTo(res, remotePath);
				}, DOWNLOAD_OP_TIMEOUT_MS);
            }
        }

    } catch (error) {
        const msg = error && error.message ? error.message : String(error)
        const code = error && error.code ? String(error.code) : ''
        const missing = code === 'ENOENT' || /no such file/i.test(msg) || /xstat:/i.test(msg)

        if (isSessionExpiredError(error)) {
            cleanupSession(sessionId, 'download_failed');
            if (!res.headersSent) res.status(440).json({ error: 'Session expired' });
            return
        }

        if (missing) {
            // Do not log missing files as application errors; it's a normal outcome for probes.
            if (!res.headersSent) res.status(404).json({ error: 'File not found' });
            return
        }

        log.error(`[DOWNLOAD] failed session=${sessionId} path=${remotePath} err=${msg}`)
		void logAppLog({
			level: 'error',
			message: msg || 'download error',
			sessionId,
			context: {
				op: 'download',
				remotePath,
				protocol: session && session.type ? session.type : null,
				server: session && session.server ? session.server : null,
				username: session && session.username ? session.username : null,
				userAgent: req.headers['user-agent'],
				ip: req.ip,
			},
		});
        if (!res.headersSent) res.status(500).json({ error: error.message });
    }
});


/**
 * Universal Upload Handler
 *
 * Supports:
 * - single file: field name "file"
 * - batch/folder: field name "files" (multiple)
 *   with optional repeated text field "paths" containing relative paths (e.g. from webkitRelativePath)
 */
app.post('/api/sftp/upload', upload.any(), async (req, res) => {
    const { sessionId, path: remoteDir } = req.body;
    const session = sessions.get(sessionId);

    const files = (req.files || []).filter(f => f && f.path);
    if (!session || !files.length) return res.status(400).json({ error: 'Invalid request' });

    const baseRemoteDir = (remoteDir && String(remoteDir).trim()) ? String(remoteDir).trim() : '/';
    const rawPaths = req.body && req.body.paths;
    const relPaths = Array.isArray(rawPaths) ? rawPaths.map(String) : (rawPaths ? [String(rawPaths)] : []);

    const posixJoin = (...parts) => path.posix.join(...parts.map(p => String(p || '').replace(/\\/g, '/')));
    const ensureLeadingSlash = (p) => (p && p.startsWith('/') ? p : `/${p || ''}`);

    const cleanupLocalFiles = () => {
        for (const f of files) {
            try {
                if (f && f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
            } catch (e) {}
        }
    };

    try {
        await runSessionOp(sessionId, async (s) => {
            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                const rel = relPaths[i] || f.originalname;
                // Normalize and drop any leading slashes so it's treated as relative.
                const safeRel = String(rel).replace(/^[\\/]+/, '').replace(/\.{2,}/g, '.');

                const remotePath = ensureLeadingSlash(posixJoin(baseRemoteDir, safeRel));
                const remoteFolder = path.posix.dirname(remotePath);

                if (s.type === 'sftp') {
                    // ssh2-sftp-client supports recursive mkdir
                    if (remoteFolder && remoteFolder !== '/' && remoteFolder !== '.') {
                        await s.client.mkdir(remoteFolder, true);
                    }
                    await s.client.put(f.path, remotePath);
                } else {
                    // basic-ftp: ensureDir creates intermediate dirs
                    if (remoteFolder && remoteFolder !== '/' && remoteFolder !== '.') {
                        await s.client.ensureDir(remoteFolder);
                    }
                    await s.client.uploadFrom(f.path, remotePath);
                }
            }
        });

        cleanupLocalFiles();
        res.json({ success: true, message: files.length === 1 ? 'Uploaded' : `Uploaded ${files.length} files` });
    } catch (error) {
        if (isSessionExpiredError(error)) {
            cleanupSession(sessionId, 'upload_failed');
            cleanupLocalFiles();
            return res.status(440).json({ error: 'Session expired' });
        }
        cleanupLocalFiles();
        res.status(500).json({ error: error.message });
    }
});

/**
 * Universal Delete Handler
 */
app.post('/api/sftp/delete', async (req, res) => {
    const { sessionId, path: remotePath, isDirectory } = req.body;
    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session expired' });

    try {
        // perform delete under session queue
        await runSessionOp(sessionId, async (s) => {
            if (s.type === 'sftp') {
                if (isDirectory) return s.client.rmdir(remotePath, true);
                return s.client.delete(remotePath);
            } else {
                if (isDirectory) return s.client.removeDir(remotePath);
                return s.client.remove(remotePath);
            }
        });
        res.json({ success: true });
    } catch (error) {
        if (isSessionExpiredError(error)) {
            cleanupSession(sessionId, 'delete_failed');
            return res.status(440).json({ error: 'Session expired' });
        }
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/sftp/disconnect', async (req, res) => {
    const { sessionId } = req.body;
    const session = sessions.get(sessionId);
    if (session) {
        if (session.type === 'sftp') {
            try { session.client.end(); } catch(e) {}
        } else {
            try { session.client.close(); } catch(e) {}
        }
        sessions.delete(sessionId);
    }
    res.json({ success: true });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', activeSessions: sessions.size }));

// --- DB endpoints (optional) ---
app.get('/api/db/health', (req, res) => {
    if (!isDbEnabled()) return res.status(503).json({ ok: false, db: 'disabled' });
    return res.json({ ok: true, db: 'enabled' });
});

app.get('/api/db/tasks', async (req, res) => {
    if (!isDbEnabled()) return res.status(503).json({ error: 'DB disabled' });
    const { sessionId, limit } = req.query;
    try {
        const rows = await listTransferTasks({ sessionId: sessionId || null, limit });
        res.json({ success: true, tasks: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/db/tasks/upsert', async (req, res) => {
    if (!isDbEnabled()) return res.status(503).json({ error: 'DB disabled' });
    const { sessionId, tasks } = req.body || {};
    if (!Array.isArray(tasks)) return res.status(400).json({ error: 'tasks array is required' });
    try {
        await upsertTransferTasks({ sessionId, tasks });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/db/snapshots', async (req, res) => {
    if (!isDbEnabled()) return res.status(503).json({ error: 'DB disabled' });
    const { sessionId, snapshotType, limit } = req.query;
    try {
        const rows = await listAnalyticsSnapshots({ sessionId: sessionId || null, snapshotType: snapshotType || null, limit });
        res.json({ success: true, snapshots: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/db/snapshots', async (req, res) => {
    if (!isDbEnabled()) return res.status(503).json({ error: 'DB disabled' });
    const { sessionId, snapshotType, path: snapshotPath, payload } = req.body || {};
    if (!snapshotType) return res.status(400).json({ error: 'snapshotType is required' });
    if (payload === undefined) return res.status(400).json({ error: 'payload is required' });
    try {
        await insertAnalyticsSnapshot({ sessionId, snapshotType, path: snapshotPath, payload });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/db/audit/recent', async (req, res) => {
    if (!isDbEnabled()) return res.status(503).json({ error: 'DB disabled' });

    const { sessionId, limit } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const session = sessions.get(sessionId);
    if (!session || !session.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    try {
        const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100));
        const [connections, downloads, logs] = await Promise.all([
            listConnectionEvents({ limit: safeLimit }),
            listDownloadEvents({ limit: safeLimit }),
            listAppLogs({ limit: safeLimit }),
        ]);

		const filteredLogs = (Array.isArray(logs) ? logs : []).filter(l => {
			const message = l && l.message ? String(l.message) : '';
			const level = l && l.level ? String(l.level) : '';
			const isMissing = /no such file/i.test(message) || /xstat:/i.test(message) || /ENOENT/i.test(message);
			const isReadme = /(^|\/)readme\.txt$/i.test(message.replace(/\\/g, '/'));
			if (level.toLowerCase() === 'error' && isMissing && isReadme) return false;
			return true;
		});


        res.json({ success: true, connections, downloads, logs: filteredLogs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    sessions: sessions.size
  });
});

app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

const PORT = process.env.PORT || 3001;

initDb().catch((err) => {
  console.error('[DB] init failed:', err && err.message ? err.message : err);
});

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`Session limits: ${MAX_SESSIONS} total, ${MAX_SESSIONS_PER_IP} per IP`);
  console.log(`Rate limit: ${Number.isFinite(SFTP_RATE_LIMIT_MAX) ? SFTP_RATE_LIMIT_MAX : 5000} requests per ${15 * 60} minutes (SFTP_RATE_LIMIT_MAX)`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});
