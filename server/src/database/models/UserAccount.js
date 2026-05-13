module.exports = (sequelize, DataTypes) => {
  const UserAccount = sequelize.define('UserAccount', {
    user_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { isEmail: true, notEmpty: true },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: true },
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: true },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'LOCKED', 'INVITED'),
      defaultValue: 'ACTIVE',
      allowNull: false,
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_seen_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    password_changed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failed_login_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    azure_object_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
    },
  }, {
    tableName: 'user_account',
    defaultScope: {
      attributes: { exclude: ['password_hash'] },
      where: { deleted_at: null },
    },
    scopes: {
      withPassword: {
        attributes: {},
        where: { deleted_at: null },
      },
      withDeleted: {
        attributes: { exclude: ['password_hash'] },
      },
      active: {
        attributes: { exclude: ['password_hash'] },
        where: { status: 'ACTIVE', deleted_at: null },
      },
    },
  });

  UserAccount.associate = (models) => {
    UserAccount.hasOne(models.PersonProfile, {
      foreignKey: 'user_id',
      as: 'profile',
    });
    UserAccount.hasMany(models.UserRoleAssignment, {
      foreignKey: 'user_id',
      as: 'roleAssignments',
    });
    UserAccount.hasMany(models.DepartmentMembership, {
      foreignKey: 'user_id',
      as: 'departmentMemberships',
    });
    UserAccount.hasMany(models.UserPermission, {
      foreignKey: 'user_id',
      as: 'directPermissions',
    });
    UserAccount.hasMany(models.RefreshToken, {
      foreignKey: 'user_id',
      as: 'refreshTokens',
    });
    UserAccount.hasMany(models.EmployeeInvitation, {
      foreignKey: 'user_id',
      as: 'invitations',
    });
  };

  // Instance method: safe JSON (never expose password_hash)
  UserAccount.prototype.toSafeJSON = function () {
    const values = { ...this.get() };
    delete values.password_hash;
    delete values.deleted_at;
    return values;
  };

  return UserAccount;
};
