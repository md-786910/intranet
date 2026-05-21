'use strict';

/**
 * reset-and-seed.js
 *
 * Truncates all runtime data, preserves module/module_action definitions,
 * and seeds a clean consistent dataset including sample employees with proper
 * invitation records so the mobile org chart works correctly.
 *
 * Usage (from server/ directory):
 *   node src/database/scripts/reset-and-seed.js
 *
 * Env: reads from ../../.env relative to this file (d:\intranet\.env)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const TENANT_ID = 1;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;

const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'owner@brightnow.online').toLowerCase().trim();
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'ChangeMe123!';
const OWNER_FIRST = process.env.OWNER_FIRST_NAME || 'Platform';
const OWNER_LAST = process.env.OWNER_LAST_NAME || 'Owner';

function tokenHash(email) {
  return crypto.createHash('sha256').update(email + ':seed-token').digest('hex').slice(0, 64);
}

async function run() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  await client.connect();
  console.log('Connected to database:', process.env.DB_NAME);

  try {
    await client.query('BEGIN');

    // ─────────────────────────────────────────────────────────────
    // PHASE 1: Truncate all runtime tables
    // Preserves: module, module_action, SequelizeMeta
    // ─────────────────────────────────────────────────────────────
    console.log('\n[1/5] Truncating runtime tables...');
    await client.query(`
      TRUNCATE
        analytics_event,
        audit_log,
        announcement_item,
        chat_block,
        chat_message,
        content_audience_rule,
        conversation,
        conversation_participant,
        department,
        department_membership,
        document_item,
        document_version,
        document_view,
        employee_invitation,
        media_asset,
        news_attachment,
        news_comment,
        news_item,
        news_like,
        news_share,
        notification,
        office_location,
        organisation,
        password_reset,
        person_profile,
        push_campaign,
        quick_link,
        refresh_token,
        role,
        role_category,
        role_permission,
        saved_item,
        user_account,
        user_permission,
        user_role_assignment,
        vertical
      RESTART IDENTITY CASCADE
    `);

    // Truncate job_title separately (may not exist in all envs)
    try {
      await client.query('TRUNCATE job_title RESTART IDENTITY CASCADE');
    } catch (_) {
      // table doesn't exist yet — skip
    }

    // Truncate category separately
    try {
      await client.query('TRUNCATE category RESTART IDENTITY CASCADE');
    } catch (_) {
      // skip
    }

    console.log('  ✓ All runtime tables cleared');

    // ─────────────────────────────────────────────────────────────
    // PHASE 2: Re-seed roles + role categories
    // ─────────────────────────────────────────────────────────────
    console.log('\n[2/5] Seeding roles and role categories...');
    const now = new Date().toISOString();

    // Fetch module_action ids (module/module_action rows were preserved)
    const { rows: moduleActions } = await client.query(`
      SELECT ma.module_action_id, m.code AS module_code, ma.action_code
      FROM module_action ma
      JOIN module m ON m.module_id = ma.module_id
    `);
    const actionMap = {};
    const allActionIds = [];
    moduleActions.forEach((ma) => {
      actionMap[`${ma.module_code}:${ma.action_code}`] = ma.module_action_id;
      allActionIds.push(ma.module_action_id);
    });

    const roleDefinitions = [
      {
        code: 'OWNER',
        name: 'Owner',
        description: 'Full platform owner with all permissions.',
        is_system: true,
        permissions: 'ALL',
      },
      {
        code: 'OFFICE_MANAGER',
        name: 'Office Manager',
        description: 'Manages office location including verticals, departments, users, and content.',
        is_system: false,
        permissions: [
          'ADMIN:MANAGE_VERTICALS', 'ADMIN:MANAGE_DEPARTMENTS', 'ADMIN:MANAGE_USERS',
          'ADMIN:MANAGE_EMPLOYEES', 'ADMIN:VIEW_ANALYTICS',
          'NEWS:VIEW', 'NEWS:CREATE', 'NEWS:EDIT', 'NEWS:DELETE', 'NEWS:PUBLISH',
          'DOCUMENTS:VIEW', 'DOCUMENTS:CREATE', 'DOCUMENTS:EDIT', 'DOCUMENTS:DELETE', 'DOCUMENTS:PUBLISH',
          'PUSH:VIEW', 'PUSH:CREATE', 'PUSH:SEND', 'PUSH:CANCEL',
          'DIRECTORY:VIEW', 'DIRECTORY:MANAGE_PROFILE', 'ANALYTICS:VIEW',
        ],
      },
      {
        code: 'CONTENT_EDITOR',
        name: 'Content Editor',
        description: 'Creates and publishes news and document content.',
        is_system: false,
        permissions: [
          'NEWS:VIEW', 'NEWS:CREATE', 'NEWS:EDIT', 'NEWS:PUBLISH',
          'DOCUMENTS:VIEW', 'DOCUMENTS:CREATE', 'DOCUMENTS:EDIT', 'DOCUMENTS:PUBLISH',
          'DIRECTORY:VIEW',
        ],
      },
      {
        code: 'EMPLOYEE',
        name: 'Employee',
        description: 'Standard employee with read access to content.',
        is_system: false,
        permissions: [
          'NEWS:VIEW', 'DOCUMENTS:VIEW', 'DIRECTORY:VIEW',
          'SEARCH:QUERY', 'SAVED:VIEW', 'SAVED:SAVE', 'SAVED:REMOVE',
        ],
      },
    ];

    const roleIdMap = {};
    for (const def of roleDefinitions) {
      const { rows: [role] } = await client.query(
        `INSERT INTO role (tenant_id, code, name, description, is_system, created_by, deleted_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,NULL,NULL,$6,$6) RETURNING role_id`,
        [TENANT_ID, def.code, def.name, def.description, def.is_system, now],
      );
      roleIdMap[def.code] = role.role_id;

      const targetIds = def.permissions === 'ALL'
        ? allActionIds
        : def.permissions.map((k) => actionMap[k]).filter(Boolean);

      for (const maId of targetIds) {
        await client.query(
          `INSERT INTO role_permission (role_id, module_action_id, effect, created_at, updated_at)
           VALUES ($1,$2,'ALLOW',$3,$3)`,
          [role.role_id, maId, now],
        );
      }
    }

    // Role categories
    const roleCategories = [
      { name: 'CEO', rank: 1 },
      { name: 'VP', rank: 2 },
      { name: 'Director', rank: 3 },
      { name: 'Manager', rank: 4 },
      { name: 'Team Lead', rank: 5 },
      { name: 'Employee', rank: 6 },
    ];
    const rcIdMap = {};
    for (const rc of roleCategories) {
      const { rows: [row] } = await client.query(
        `INSERT INTO role_category (tenant_id, name, rank, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$4) RETURNING role_category_id`,
        [TENANT_ID, rc.name, rc.rank, now],
      );
      rcIdMap[rc.name] = row.role_category_id;
    }

    console.log('  ✓ Roles and role categories seeded');

    // ─────────────────────────────────────────────────────────────
    // PHASE 3: Org structure
    // ─────────────────────────────────────────────────────────────
    console.log('\n[3/5] Seeding org structure...');

    const { rows: [org] } = await client.query(
      `INSERT INTO organisation (name, code, status, sort_order, deleted_at, created_at, updated_at)
       VALUES ('BrightNow','BrightNow','ACTIVE',0,NULL,$1,$1) RETURNING id`,
      [now],
    );
    const orgId = org.id;

    const { rows: [office] } = await client.query(
      `INSERT INTO office_location (tenant_id, name, code, sort_order, deleted_at, created_at, updated_at)
       VALUES ($1,'Head Office','HO',0,NULL,$2,$2) RETURNING id`,
      [TENANT_ID, now],
    );
    const officeId = office.id;

    // Verticals
    const { rows: [vtTech] } = await client.query(
      `INSERT INTO vertical (tenant_id, office_location_id, name, code, sort_order, deleted_at, created_at, updated_at)
       VALUES ($1,$2,'Technology','TECH',0,NULL,$3,$3) RETURNING id`,
      [TENANT_ID, officeId, now],
    );
    const { rows: [vtOps] } = await client.query(
      `INSERT INTO vertical (tenant_id, office_location_id, name, code, sort_order, deleted_at, created_at, updated_at)
       VALUES ($1,$2,'Operations','OPS',1,NULL,$3,$3) RETURNING id`,
      [TENANT_ID, officeId, now],
    );

    // Departments
    const { rows: [deptEng] } = await client.query(
      `INSERT INTO department (tenant_id, vertical_id, name, code, sort_order, deleted_at, created_at, updated_at)
       VALUES ($1,$2,'Engineering','ENG',0,NULL,$3,$3) RETURNING id`,
      [TENANT_ID, vtTech.id, now],
    );
    const { rows: [deptProduct] } = await client.query(
      `INSERT INTO department (tenant_id, vertical_id, name, code, sort_order, deleted_at, created_at, updated_at)
       VALUES ($1,$2,'Product','PROD',1,NULL,$3,$3) RETURNING id`,
      [TENANT_ID, vtTech.id, now],
    );
    const { rows: [deptHR] } = await client.query(
      `INSERT INTO department (tenant_id, vertical_id, name, code, sort_order, deleted_at, created_at, updated_at)
       VALUES ($1,$2,'Human Resources','HR',0,NULL,$3,$3) RETURNING id`,
      [TENANT_ID, vtOps.id, now],
    );

    console.log('  ✓ Organisation → Office → Verticals → Departments created');

    // ─────────────────────────────────────────────────────────────
    // PHASE 4: Owner account
    // ─────────────────────────────────────────────────────────────
    console.log('\n[4/5] Seeding owner account...');

    const ownerHash = await bcrypt.hash(OWNER_PASSWORD, BCRYPT_ROUNDS);
    const { rows: [ownerUser] } = await client.query(
      `INSERT INTO user_account (email, password_hash, first_name, last_name, status, email_verified, failed_login_attempts, deleted_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'ACTIVE',true,0,NULL,$5,$5) RETURNING user_id`,
      [OWNER_EMAIL, ownerHash, OWNER_FIRST, OWNER_LAST, now],
    );
    const ownerId = ownerUser.user_id;

    await client.query(
      `INSERT INTO person_profile (user_id, job_title, created_at, updated_at)
       VALUES ($1,'Platform Owner',$2,$2)`,
      [ownerId, now],
    );

    await client.query(
      `INSERT INTO user_role_assignment (user_id, role_id, scope_type, scope_id, assigned_by, starts_at, ends_at, created_at, updated_at)
       VALUES ($1,$2,'ORGANISATION',$3,NULL,NULL,NULL,$4,$4)`,
      [ownerId, roleIdMap['OWNER'], orgId, now],
    );

    console.log(`  ✓ Owner: ${OWNER_EMAIL}`);

    // ─────────────────────────────────────────────────────────────
    // PHASE 5: Sample employees (with invitation records for org chart)
    // ─────────────────────────────────────────────────────────────
    console.log('\n[5/5] Seeding sample employees...');

    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 10).toISOString();
    const employeeRoleId = roleIdMap['EMPLOYEE'];

    async function createEmployee({
      email, password = 'Employee123!', firstName, lastName, jobTitle,
      deptId, roleCategoryName, reportsToId = null,
    }) {
      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const { rows: [u] } = await client.query(
        `INSERT INTO user_account (email, password_hash, first_name, last_name, status, email_verified, failed_login_attempts, deleted_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'ACTIVE',true,0,NULL,$5,$5) RETURNING user_id`,
        [email, hash, firstName, lastName, now],
      );
      const userId = u.user_id;

      await client.query(
        `INSERT INTO person_profile (user_id, job_title, role_category_id, reports_to_user_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$5)`,
        [userId, jobTitle, rcIdMap[roleCategoryName] || null, reportsToId, now],
      );

      await client.query(
        `INSERT INTO department_membership (user_id, department_id, is_primary, created_at, updated_at)
         VALUES ($1,$2,true,$3,$3)`,
        [userId, deptId, now],
      );

      await client.query(
        `INSERT INTO user_role_assignment (user_id, role_id, scope_type, scope_id, assigned_by, starts_at, ends_at, created_at, updated_at)
         VALUES ($1,$2,'DEPARTMENT',$3,NULL,NULL,NULL,$4,$4)`,
        [userId, employeeRoleId, deptId, now],
      );

      // Invitation record (accepted) — required for /org/people-tree
      await client.query(
        `INSERT INTO employee_invitation (tenant_id, user_id, email, token_hash, expires_at, accepted_at, invited_by_user_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [TENANT_ID, userId, email, tokenHash(email), farFuture, now, ownerId, now],
      );

      return userId;
    }

    // Level 1 — CEO
    const sarahId = await createEmployee({
      email: 'sarah.chen@brightnow.online',
      firstName: 'Sarah', lastName: 'Chen',
      jobTitle: 'Chief Executive Officer',
      deptId: deptEng.id, roleCategoryName: 'CEO',
    });

    // Level 2 — VP + Director
    const jamesId = await createEmployee({
      email: 'james.okafor@brightnow.online',
      firstName: 'James', lastName: 'Okafor',
      jobTitle: 'VP of Engineering',
      deptId: deptEng.id, roleCategoryName: 'VP',
      reportsToId: sarahId,
    });
    const fatimaId = await createEmployee({
      email: 'fatima.alrashid@brightnow.online',
      firstName: 'Fatima', lastName: 'Al-Rashid',
      jobTitle: 'HR Director',
      deptId: deptHR.id, roleCategoryName: 'Director',
      reportsToId: sarahId,
    });

    // Level 3 — individual contributors
    await createEmployee({
      email: 'priya.sharma@brightnow.online',
      firstName: 'Priya', lastName: 'Sharma',
      jobTitle: 'Senior Engineer',
      deptId: deptEng.id, roleCategoryName: 'Employee',
      reportsToId: jamesId,
    });
    await createEmployee({
      email: 'luca.muller@brightnow.online',
      firstName: 'Luca', lastName: 'Müller',
      jobTitle: 'Product Manager',
      deptId: deptProduct.id, roleCategoryName: 'Employee',
      reportsToId: jamesId,
    });
    await createEmployee({
      email: 'tom.nguyen@brightnow.online',
      firstName: 'Tom', lastName: 'Nguyen',
      jobTitle: 'HR Coordinator',
      deptId: deptHR.id, roleCategoryName: 'Employee',
      reportsToId: fatimaId,
    });

    console.log('  ✓ 6 sample employees seeded with invitation records');

    await client.query('COMMIT');

    console.log('\n========================================');
    console.log('  DATABASE RESET + SEED COMPLETE');
    console.log(`  Owner: ${OWNER_EMAIL}`);
    console.log('  ** Change the owner password immediately **');
    console.log('========================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n[ERROR] Rolling back:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
