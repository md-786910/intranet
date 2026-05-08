module.exports = (sequelize, DataTypes) => {
  const DocumentView = sequelize.define('DocumentView', {
    view_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    document_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    viewed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'document_view',
    timestamps: false,
    indexes: [
      { fields: ['user_id', 'viewed_at'] },
      { unique: true, fields: ['user_id', 'document_item_id'] },
    ],
  });

  DocumentView.associate = (models) => {
    DocumentView.belongsTo(models.DocumentItem, {
      foreignKey: 'document_item_id',
      as: 'document',
    });
    DocumentView.belongsTo(models.UserAccount, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return DocumentView;
};
