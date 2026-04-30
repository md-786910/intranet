module.exports = (sequelize, DataTypes) => {
  const EmployeeInvitation = sequelize.define('EmployeeInvitation', {
    invitation_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { isEmail: true },
    },
    token_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    accepted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    invited_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'employee_invitation',
    updatedAt: false,
  });

  EmployeeInvitation.associate = (models) => {
    EmployeeInvitation.belongsTo(models.UserAccount, {
      foreignKey: 'user_id',
      as: 'user',
    });
    EmployeeInvitation.belongsTo(models.UserAccount, {
      foreignKey: 'invited_by_user_id',
      as: 'invitedBy',
    });
  };

  return EmployeeInvitation;
};
