module.exports = (sequelize, DataTypes) => {
  const PersonProfile = sequelize.define('PersonProfile', {
    profile_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    job_title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    department_display: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    date_of_joining: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    employee_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    company_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    employee_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    company_node_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    office_node_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    role_category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reports_to_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'person_profile',
  });

  PersonProfile.associate = (models) => {
    PersonProfile.belongsTo(models.UserAccount, {
      foreignKey: 'user_id',
      as: 'user',
    });
    PersonProfile.belongsTo(models.RoleCategory, {
      foreignKey: 'role_category_id',
      as: 'roleCategory',
    });
    PersonProfile.belongsTo(models.UserAccount, {
      foreignKey: 'reports_to_user_id',
      as: 'manager',
    });
    PersonProfile.belongsTo(models.OrgNode, {
      foreignKey: 'company_node_id',
      as: 'companyNode',
    });
    PersonProfile.belongsTo(models.OrgNode, {
      foreignKey: 'office_node_id',
      as: 'officeNode',
    });
  };

  return PersonProfile;
};
