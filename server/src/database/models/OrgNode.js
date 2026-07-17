module.exports = (sequelize, DataTypes) => {
  const OrgNode = sequelize.define('OrgNode', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    organisation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    node_type: {
      type: DataTypes.ENUM('GROUP', 'COMPANY', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT', 'ADMIN_UNIT'),
      allowNull: false,
    },
    kind: {
      type: DataTypes.ENUM('OPERATIONAL', 'ADMINISTRATIVE'),
      allowNull: false,
      defaultValue: 'OPERATIONAL',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { notEmpty: true },
    },
    code: { type: DataTypes.STRING(64), allowNull: true },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED'),
      defaultValue: 'ACTIVE',
      allowNull: false,
    },
    address: { type: DataTypes.TEXT, allowNull: true },
    city: { type: DataTypes.STRING(128), allowNull: true },
    country: { type: DataTypes.STRING(64), allowNull: true },
    timezone: { type: DataTypes.STRING(64), allowNull: true },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    path: { type: DataTypes.STRING(1024), allowNull: true },
    legacy_ref: { type: DataTypes.STRING(64), allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'org_node',
    defaultScope: { where: { deleted_at: null } },
    scopes: { withDeleted: {} },
  });

  OrgNode.associate = (models) => {
    OrgNode.belongsTo(models.Organisation, {
      foreignKey: 'organisation_id',
      as: 'organisation',
    });
    OrgNode.belongsTo(models.OrgNode, {
      foreignKey: 'parent_id',
      as: 'parent',
    });
    OrgNode.hasMany(models.OrgNode, {
      foreignKey: 'parent_id',
      as: 'children',
    });
    OrgNode.hasMany(models.NodeMembership, {
      foreignKey: 'node_id',
      as: 'memberships',
    });
  };

  return OrgNode;
};
