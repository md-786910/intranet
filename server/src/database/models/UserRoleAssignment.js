module.exports = (sequelize, DataTypes) => {
  const UserRoleAssignment = sequelize.define('UserRoleAssignment', {
    assignment_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    org_unit_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    assigned_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    starts_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ends_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'user_role_assignment',
  });

  UserRoleAssignment.associate = (models) => {
    UserRoleAssignment.belongsTo(models.UserAccount, {
      foreignKey: 'user_id',
      as: 'user',
    });
    UserRoleAssignment.belongsTo(models.Role, {
      foreignKey: 'role_id',
      as: 'role',
    });
    UserRoleAssignment.belongsTo(models.OrgUnit, {
      foreignKey: 'org_unit_id',
      as: 'orgUnit',
    });
  };

  return UserRoleAssignment;
};
