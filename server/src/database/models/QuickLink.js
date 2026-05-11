module.exports = (sequelize, DataTypes) => {
  const QuickLink = sequelize.define(
    'QuickLink',
    {
      quick_link_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      tenant_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      label: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: { notEmpty: true },
      },
      url: {
        type: DataTypes.STRING(500),
        allowNull: false,
        validate: { notEmpty: true },
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'quick_link',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      defaultScope: {
        where: { deleted_at: null },
      },
      scopes: {
        withDeleted: {},
      },
    },
  );

  QuickLink.associate = (models) => {
    QuickLink.belongsTo(models.UserAccount, {
      foreignKey: 'created_by',
      as: 'creator',
    });
  };

  return QuickLink;
};
