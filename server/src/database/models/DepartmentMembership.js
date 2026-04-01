module.exports = (sequelize, DataTypes) => {
  const DepartmentMembership = sequelize.define('DepartmentMembership', {
    membership_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    joined_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'department_membership',
  });

  DepartmentMembership.associate = (models) => {
    DepartmentMembership.belongsTo(models.UserAccount, {
      foreignKey: 'user_id',
      as: 'user',
    });
    DepartmentMembership.belongsTo(models.Department, {
      foreignKey: 'department_id',
      as: 'department',
    });
  };

  return DepartmentMembership;
};
