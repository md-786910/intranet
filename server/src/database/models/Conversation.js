module.exports = (sequelize, DataTypes) => {
  const Conversation = sequelize.define('Conversation', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    tableName: 'conversation',
  });

  Conversation.associate = (models) => {
    Conversation.belongsTo(models.UserAccount, {
      foreignKey: 'created_by',
      as: 'creator',
    });
    Conversation.hasMany(models.ConversationParticipant, {
      foreignKey: 'conversation_id',
      as: 'participants',
    });
    Conversation.hasMany(models.ChatMessage, {
      foreignKey: 'conversation_id',
      as: 'messages',
    });
  };

  return Conversation;
};
