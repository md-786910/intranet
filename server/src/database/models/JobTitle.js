module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'JobTitle',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
    },
    { tableName: 'job_title' },
  );
};
