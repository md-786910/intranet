module.exports = (sequelize, DataTypes) => {
  const OrgUnitClosure = sequelize.define('OrgUnitClosure', {
    ancestor_org_unit_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: 'org_unit', key: 'org_unit_id' },
    },
    descendant_org_unit_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: 'org_unit', key: 'org_unit_id' },
    },
    depth: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'org_unit_closure',
    timestamps: false,
  });

  OrgUnitClosure.associate = (models) => {
    OrgUnitClosure.belongsTo(models.OrgUnit, {
      as: 'ancestor',
      foreignKey: 'ancestor_org_unit_id',
    });
    OrgUnitClosure.belongsTo(models.OrgUnit, {
      as: 'descendant',
      foreignKey: 'descendant_org_unit_id',
    });
  };

  return OrgUnitClosure;
};
