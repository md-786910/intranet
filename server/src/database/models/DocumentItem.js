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
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'document_item',
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
    DocumentItem.belongsTo(models.OrgUnit, {
      foreignKey: 'owning_org_unit_id',
      as: 'owningOrgUnit',
    });
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
