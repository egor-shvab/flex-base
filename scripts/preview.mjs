/**
 * Import order is the whole file: `.env` must be loaded before the launcher, and must stay out of
 * the launcher, which the e2e suite also uses against its disposable database.
 */
import 'dotenv/config'
import './serve-output.mjs'
