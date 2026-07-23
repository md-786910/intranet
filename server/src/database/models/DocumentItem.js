module.exports = (sequelize, DataTypes) => {
  const DocumentItem = sequelize.define('DocumentItem', {
    document_item_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { notEmpty: true },
    },
    slug: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'),
      defaultValue: 'DRAFT',
      allowNull: false,
    },
    scheduled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    scheduled_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    priority: {
      type: DataTypes.ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT'),
      defaultValue: 'NORMAL',
      allowNull: false,
    },
    push_notify: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    author_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    published_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    unpublished_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    deleted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    owning_scope_type: {
      type: DataTypes.ENUM(
        'ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT',
        'GROUP', 'COMPANY', 'ADMIN_UNIT',
      ),
      allowNull: false,
    },
    owning_scope_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    unpublished_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'document_item',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    defaultScope: {
      where: { deleted_at: null },
    },
    scopes: {
      withDeleted: {},
      published: { where: { status: 'PUBLISHED', deleted_at: null } },
    },
  });

  DocumentItem.associate = (models) => {
    DocumentItem.belongsTo(models.UserAccount, {
      foreignKey: 'author_id',
      as: 'author',
    });
    DocumentItem.belongsTo(models.UserAccount, {
      foreignKey: 'updated_by',
      as: 'updater',
    });
    DocumentItem.belongsTo(models.UserAccount, {
      foreignKey: 'published_by',
      as: 'publisher',
    });
    DocumentItem.belongsTo(models.UserAccount, {
      foreignKey: 'unpublished_by',
      as: 'unpublisher',
    });
    DocumentItem.belongsTo(models.UserAccount, {
      foreignKey: 'deleted_by',
      as: 'deleter',
    });
    // Polymorphic scope — use scope.service.js to resolve owning_scope_type + owning_scope_id
    DocumentItem.belongsTo(models.Category, {
      foreignKey: 'category_id',
      as: 'category',
    });
    DocumentItem.hasMany(models.DocumentVersion, {
      foreignKey: 'document_item_id',
      as: 'versions',
    });
    DocumentItem.hasMany(models.ContentAudienceRule, {
      foreignKey: 'entity_id',
      as: 'audienceRules',
      constraints: false,
      scope: { entity_type: 'DOCUMENT' },
    });
  };

  return DocumentItem;
};
