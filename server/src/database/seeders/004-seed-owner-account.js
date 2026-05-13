"use strict";

const bcrypt = require("bcryptjs");

const DEFAULT_ORGANISATION_ID = 1;

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;

    // 1. Create the root organisation
    await queryInterface.bulkInsert("organisation", [
      {
        id: DEFAULT_ORGANISATION_ID,
        name: "BrightNow",
        code: "BrightNow",
        status: "ACTIVE",
        sort_order: 0,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);

    // 2. Create owner user account
    const email = process.env.OWNER_EMAIL || "owner@brightnow.online";
    const password = process.env.OWNER_PASSWORD || "ChangeMe123!";
    const passwordHash = await bcrypt.hash(password, rounds);

    await queryInterface.bulkInsert("user_account", [
      {
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        first_name: process.env.OWNER_FIRST_NAME || "Platform",
        last_name: process.env.OWNER_LAST_NAME || "Owner",
        status: "ACTIVE",
        email_verified: true,
        failed_login_attempts: 0,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);

    // Query back the auto-generated user_id
    const [user] = await queryInterface.sequelize.query(
      `SELECT user_id FROM user_account WHERE email = '${email.toLowerCase().trim()}' LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT },
    );
    const userId = user.user_id;

    // 3. Create person profile for owner
    await queryInterface.bulkInsert("person_profile", [
      {
        user_id: userId,
        job_title: "Platform Owner",
        created_at: now,
        updated_at: now,
      },
    ]);

    // 4. Assign Owner role at organisation scope
    const [ownerRole] = await queryInterface.sequelize.query(
      `SELECT role_id FROM role WHERE code = 'OWNER' AND tenant_id = 1 LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT },
    );

    if (ownerRole) {
      await queryInterface.bulkInsert("user_role_assignment", [
        {
          user_id: userId,
          role_id: ownerRole.role_id,
          scope_type: "ORGANISATION",
          scope_id: DEFAULT_ORGANISATION_ID,
          assigned_by: null,
          starts_at: null,
          ends_at: null,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    // Log warning to change default password
    console.log("\n========================================");
    console.log("  OWNER ACCOUNT CREATED");
    console.log(`  Email: ${email}`);
    console.log("  ** CHANGE THE DEFAULT PASSWORD IMMEDIATELY **");
    console.log("========================================\n");
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("user_role_assignment", null, {});
    await queryInterface.bulkDelete("person_profile", null, {});
    await queryInterface.bulkDelete("user_account", null, {});
    await queryInterface.bulkDelete("organisation", null, {});
  },
};
