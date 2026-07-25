module.exports = (sequelize, DataTypes) => {
  const AppSettings = sequelize.define(
    'AppSettings',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        defaultValue: 1,
      },
      application_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'BrightNow',
      },
      meta_title: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'BrightNow',
      },
      updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: 'app_settings',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  AppSettings.associate = (models) => {
    AppSettings.belongsTo(models.UserAccount, {
      foreignKey: 'updated_by',
      as: 'updater',
    });
  };

  return AppSettings;
};
