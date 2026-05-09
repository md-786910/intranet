module.exports = (sequelize, DataTypes) => {
  const ConversationParticipant = sequelize.define('ConversationParticipant', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    conversation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    last_read_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    joined_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'conversation_participant',
    indexes: [
      { unique: true, fields: ['conversation_id', 'user_id'] },
    ],
  });

  ConversationParticipant.associate = (models) => {
    ConversationParticipant.belongsTo(models.Conversation, {
      foreignKey: 'conversation_id',
      as: 'conversation',
    });
    ConversationParticipant.belongsTo(models.UserAccount, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return ConversationParticipant;
};
