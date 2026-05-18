module.exports = (sequelize, DataTypes) => {
  const AnnouncementItem = sequelize.define('AnnouncementItem', {
    announcement_item_id: {
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
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED'),
      defaultValue: 'DRAFT',
      allowNull: false,
    },
    priority: {
      type: DataTypes.ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT'),
      defaultValue: 'NORMAL',
      allowNull: false,
    },
    show_in_marquee: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    push_notify: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    marquee_starts_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    marquee_ends_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
      type: DataTypes.ENUM('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT'),
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
    tableName: 'announcement_item',
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

  AnnouncementItem.associate = (models) => {
    AnnouncementItem.belongsTo(models.UserAccount, { foreignKey: 'author_id', as: 'author' });
    AnnouncementItem.belongsTo(models.UserAccount, { foreignKey: 'updated_by', as: 'updater' });
    AnnouncementItem.belongsTo(models.UserAccount, { foreignKey: 'published_by', as: 'publisher' });
    AnnouncementItem.belongsTo(models.UserAccount, { foreignKey: 'unpublished_by', as: 'unpublisher' });
    AnnouncementItem.belongsTo(models.UserAccount, { foreignKey: 'archived_by', as: 'archiver' });
    AnnouncementItem.belongsTo(models.UserAccount, { foreignKey: 'deleted_by', as: 'deleter' });
    AnnouncementItem.hasMany(models.ContentAudienceRule, {
      foreignKey: 'entity_id',
      as: 'audienceRules',
      constraints: false,
      scope: { entity_type: 'ANNOUNCEMENT' },
    });
  };

  return AnnouncementItem;
};
