module.exports = (sequelize, DataTypes) => {
  const DocumentVersion = sequelize.define('DocumentVersion', {
    document_version_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    document_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    version_no: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    file_url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    file_name: {
      type: DataTypes.STRING(512),
      allowNull: false,
    },
    file_size: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    mime_type: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    changelog: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    uploaded_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    tableName: 'document_version',
    timestamps: true,
    updatedAt: false,
    createdAt: 'created_at',
  });

  DocumentVersion.associate = (models) => {
    DocumentVersion.belongsTo(models.DocumentItem, {
      foreignKey: 'document_item_id',
      as: 'document',
    });
    DocumentVersion.belongsTo(models.UserAccount, {
      foreignKey: 'uploaded_by',
      as: 'uploader',
    });
  };

  return DocumentVersion;
};
