module.exports = (sequelize, DataTypes) => {
  const ChatMessage = sequelize.define('ChatMessage', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    conversation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    message_type: {
      type: DataTypes.ENUM('TEXT', 'ATTACHMENT'),
      allowNull: false,
      defaultValue: 'TEXT',
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'chat_message',
    defaultScope: { where: { deleted_at: null } },
    scopes: { withDeleted: {} },
  });

  ChatMessage.associate = (models) => {
    ChatMessage.belongsTo(models.Conversation, {
      foreignKey: 'conversation_id',
      as: 'conversation',
    });
    ChatMessage.belongsTo(models.UserAccount, {
      foreignKey: 'sender_id',
      as: 'sender',
    });
  };

  return ChatMessage;
};
