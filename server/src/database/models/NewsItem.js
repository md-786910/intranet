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
    status: {
      type: DataTypes.ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED'),
      defaultValue: 'DRAFT',
      allowNull: false,
    },
    author_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    owning_org_unit_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    published_at: {
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
    NewsItem.belongsTo(models.OrgUnit, {
      foreignKey: 'owning_org_unit_id',
      as: 'owningOrgUnit',
    });
    NewsItem.belongsTo(models.MediaAsset, {
      foreignKey: 'cover_image_id',
      as: 'coverImage',
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
