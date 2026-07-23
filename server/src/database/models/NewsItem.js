module.exports = (sequelize, DataTypes) => {
  const NewsItem = sequelize.define('NewsItem', {
    news_item_id: {
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
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cover_image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cover_image_id: {
      type: DataTypes.INTEGER,
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
    related_news_ids: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
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
    archived_by: {
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
    archived_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'news_item',
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

  NewsItem.associate = (models) => {
    NewsItem.belongsTo(models.UserAccount, {
      foreignKey: 'author_id',
      as: 'author',
    });
    NewsItem.belongsTo(models.UserAccount, {
      foreignKey: 'updated_by',
      as: 'updater',
    });
    NewsItem.belongsTo(models.UserAccount, {
      foreignKey: 'published_by',
      as: 'publisher',
    });
    NewsItem.belongsTo(models.UserAccount, {
      foreignKey: 'unpublished_by',
      as: 'unpublisher',
    });
    NewsItem.belongsTo(models.UserAccount, {
      foreignKey: 'archived_by',
      as: 'archiver',
    });
    NewsItem.belongsTo(models.UserAccount, {
      foreignKey: 'deleted_by',
      as: 'deleter',
    });
    // Polymorphic scope — use scope.service.js to resolve owning_scope_type + owning_scope_id
    NewsItem.belongsTo(models.MediaAsset, {
      foreignKey: 'cover_image_id',
      as: 'coverImage',
    });
    NewsItem.belongsTo(models.Category, {
      foreignKey: 'category_id',
      as: 'category',
    });
    NewsItem.hasMany(models.NewsAttachment, {
      foreignKey: 'news_item_id',
      as: 'attachments',
    });
    NewsItem.hasMany(models.ContentAudienceRule, {
      foreignKey: 'entity_id',
      as: 'audienceRules',
      constraints: false,
      scope: { entity_type: 'NEWS' },
    });
  };

  return NewsItem;
};
