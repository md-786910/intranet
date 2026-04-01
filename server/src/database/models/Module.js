module.exports = (sequelize, DataTypes) => {
  const Module = sequelize.define('Module', {
    module_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'module',
  });

  Module.associate = (models) => {
    Module.hasMany(models.ModuleAction, {
      foreignKey: 'module_id',
      as: 'actions',
    });
  };

  return Module;
};
