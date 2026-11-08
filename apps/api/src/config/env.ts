import { config } from 'dotenv';

// Load .env eagerly. Dynamic modules (DatabaseModule.forFeature) decide which
// repository class to bind at import time — before ConfigModule has run — so
// env must already be in process.env by then. Real env vars still win.
config({ quiet: true });
