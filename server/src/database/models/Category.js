module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    category_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    entity_type: {
      type: DataTypes.ENUM('NEWS', 'DOCUMENT'),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { notEmpty: true },
    },
    slug: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    parent_category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    creator_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
    tableName: 'category',
    defaultScope: {
      where: { deleted_at: null },
    },
    scopes: {
      withDeleted: {},
    },
  });

  Category.ENTITY_NEWS = 'NEWS';
  Category.ENTITY_DOCUMENT = 'DOCUMENT';
  Category.ENTITY_TYPES = ['NEWS', 'DOCUMENT'];

  Category.associate = (models) => {
    Category.belongsTo(models.Category, {
      as: 'parent',
      foreignKey: 'parent_category_id',
    });
    Category.hasMany(models.Category, {
      as: 'children',
      foreignKey: 'parent_category_id',
    });
    Category.hasMany(models.DocumentItem, {
      foreignKey: 'category_id',
      as: 'documents',
    });
    Category.hasMany(models.NewsItem, {
      foreignKey: 'category_id',
      as: 'newsItems',
    });
    Category.belongsTo(models.UserAccount, {
      as: 'creator',
      foreignKey: 'creator_id',
    });
    Category.belongsTo(models.UserAccount, {
      as: 'updater',
      foreignKey: 'updated_by',
    });
    Category.belongsTo(models.UserAccount, {
      as: 'deleter',
      foreignKey: 'deleted_by',
    });
  };

  return Category;
};
