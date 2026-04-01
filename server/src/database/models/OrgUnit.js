module.exports = (sequelize, DataTypes) => {
  const OrgUnit = sequelize.define('OrgUnit', {
    org_unit_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    parent_org_unit_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'org_unit', key: 'org_unit_id' },
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    node_type: {
      type: DataTypes.ENUM('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT'),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { notEmpty: true, len: [1, 255] },
    },
    code: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    path: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
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
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'org_unit',
    defaultScope: {
      where: { deleted_at: null },
    },
    scopes: {
      withDeleted: {},
      active: { where: { status: 'ACTIVE', deleted_at: null } },
    },
  });

  OrgUnit.associate = (models) => {
    OrgUnit.belongsTo(models.OrgUnit, {
      as: 'parent',
      foreignKey: 'parent_org_unit_id',
    });
    OrgUnit.hasMany(models.OrgUnit, {
      as: 'children',
      foreignKey: 'parent_org_unit_id',
    });
    OrgUnit.hasMany(models.UserRoleAssignment, {
      foreignKey: 'org_unit_id',
    });
    OrgUnit.hasMany(models.DepartmentMembership, {
      foreignKey: 'department_id',
    });
  };

  return OrgUnit;
};
