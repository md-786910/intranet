module.exports = (sequelize, DataTypes) => {
  const MediaAsset = sequelize.define('MediaAsset', {
    media_asset_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    original_name: {
      type: DataTypes.STRING(512),
      allowNull: false,
    },
    file_name: {
      type: DataTypes.STRING(512),
      allowNull: false,
    },
    mime_type: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    size_bytes: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    storage_path: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    alt_text: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    uploaded_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    deleted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'media_asset',
    defaultScope: {
      where: { deleted_at: null },
    },
    scopes: {
      withDeleted: {},
    },
  });

  MediaAsset.associate = (models) => {
    MediaAsset.belongsTo(models.UserAccount, {
      foreignKey: 'uploaded_by',
      as: 'uploader',
    });
    MediaAsset.belongsTo(models.UserAccount, {
      foreignKey: 'deleted_by',
      as: 'deleter',
    });
  };

  return MediaAsset;
};
