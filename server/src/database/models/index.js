const { Sequelize } = require("sequelize");
const fs = require("fs");
const path = require("path");
const configFile = require("../../config/database");

const env = process.env.NODE_ENV || "development";
const config = configFile[env];

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    port: config.port,
    dialect: config.dialect,
    logging: config.logging,
    pool: config.pool || {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000,
    },
    define: config.define || {
      underscored: true,
      timestamps: true,
      freezeTableName: true,
    },
    dialectOptions: config.dialectOptions || {},
  },
);

const db = {};

// Auto-load all model files in this directory
fs.readdirSync(__dirname)
  .filter((file) => file !== "index.js" && file.endsWith(".js"))
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes,
    );
    db[model.name] = model;
  });

// Run associations after all models are loaded
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
