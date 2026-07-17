module.exports = (sequelize, DataTypes) => {
  const NodeMembership = sequelize.define('NodeMembership', {
    membership_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    node_id: {
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
    tableName: 'node_membership',
  });

  NodeMembership.associate = (models) => {
    NodeMembership.belongsTo(models.UserAccount, {
      foreignKey: 'user_id',
      as: 'user',
    });
    NodeMembership.belongsTo(models.OrgNode, {
      foreignKey: 'node_id',
      as: 'node',
    });
  };

  return NodeMembership;
};
