module.exports = (sequelize, DataTypes) => {
  const ChatBlock = sequelize.define('ChatBlock', {
    chat_block_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // The viewer — when this user searches chat or tries to start a
    // conversation, `blocked_user_id` is hidden / unreachable.
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    blocked_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Admin who set the block (nullable so the row survives admin offboarding).
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'chat_block',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['user_id', 'blocked_user_id'] },
      { fields: ['user_id'] },
    ],
  });

  ChatBlock.associate = (models) => {
    ChatBlock.belongsTo(models.UserAccount, { foreignKey: 'user_id', as: 'user' });
    ChatBlock.belongsTo(models.UserAccount, { foreignKey: 'blocked_user_id', as: 'blockedUser' });
    ChatBlock.belongsTo(models.UserAccount, { foreignKey: 'created_by', as: 'creator' });
  };

  return ChatBlock;
};
